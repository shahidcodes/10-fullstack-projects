import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:voting_app/features/elections/domain/repository/election_repository.dart';

//import '../../domain/repositories/election_repository.dart';
import 'election_event.dart';
import 'election_state.dart';

class ElectionBloc extends Bloc<ElectionEvent, ElectionState> {
  final ElectionRepository _electionRepository;

  ElectionBloc({required this._electionRepository})
    : super(const ElectionInitial()) {
    on<ElectionListRequested>(_onElectionListRequested);
    on<ElectionDetailsRequested>(_onElectionDetailsRequested);
  }

  Future<void> _onElectionListRequested(
    ElectionListRequested event,
    Emitter<ElectionState> emit,
  ) async {
    emit(const ElectionLoading());

    try {
      final elections = await _electionRepository.getElections();
      emit(ElectionsLoaded(elections));
    } catch (error) {
      emit(ElectionFailure(_extractMessage(error)));
    }
  }

  Future<void> _onElectionDetailsRequested(
    ElectionDetailsRequested event,
    Emitter<ElectionState> emit,
  ) async {
    emit(const ElectionLoading());

    try {
      final election = await _electionRepository.getElectionById(
        event.electionId,
      );

      emit(ElectionDetailsLoaded(election));
    } catch (error) {
      emit(ElectionFailure(_extractMessage(error)));
    }
  }

  String _extractMessage(Object error) {
    return error.toString().replaceFirst('Exception: ', '');
  }
}
