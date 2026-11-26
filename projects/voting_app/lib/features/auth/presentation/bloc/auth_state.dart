import 'package:equatable/equatable.dart';

import '../../data/models/user_model.dart';

abstract class AuthState extends Equatable {
  const AuthState();

  @override
  List<Object?> get props => [];
}

// Initial state.
class AuthInitial extends AuthState {
  const AuthInitial();
}

// An authentication operation is in progress.
class AuthLoading extends AuthState {
  const AuthLoading();
}

// User is authenticated.
class Authenticated extends AuthState {
  final UserModel user;

  const Authenticated(this.user);

  @override
  List<Object?> get props => [user];
}

// User is not authenticated.
class Unauthenticated extends AuthState {
  const Unauthenticated();
}

// Checking the Authentication
class AuthChecking extends AuthState {
  const AuthChecking();
}

// Authentication operation failed.
class AuthFailure extends AuthState {
  final String message;

  const AuthFailure(this.message);

  @override
  List<Object?> get props => [message];
}
